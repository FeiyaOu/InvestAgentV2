"""Email + password accounts with JWT sessions."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import EmailStr, Field

from api import repository
from api.db import session_scope
from api.deps import CurrentUser, current_user
from api.schemas import StrictModel
from api.security import create_token, decode_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(StrictModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(default="", max_length=40)


class LoginRequest(StrictModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(StrictModel):
    id: str
    email: str
    display_name: str
    is_guest: bool = False


class TokenOut(StrictModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


def _token(request: Request, user) -> TokenOut:
    settings = request.app.state.settings
    return TokenOut(access_token=create_token(user.id, settings.jwt_secret, ttl_hours=settings.jwt_ttl_hours),
                    user=UserOut(id=user.id, email=user.email, display_name=user.display_name))


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterRequest, request: Request):
    if not request.app.state.settings.allow_registration:
        raise HTTPException(status_code=403, detail="当前未开放注册")
    with session_scope(request.app.state.engine) as session:
        if repository.user_by_email(session, body.email) is not None:
            raise HTTPException(status_code=409, detail="邮箱已注册")
        user = repository.create_user(session, email=body.email, password_hash=hash_password(body.password),
                                      display_name=body.display_name)
        return _token(request, user)


@router.post("/login", response_model=TokenOut)
def login(body: LoginRequest, request: Request):
    with session_scope(request.app.state.engine) as session:
        user = repository.user_by_email(session, body.email)
        if user is None or not verify_password(body.password, user.password_hash):
            raise HTTPException(status_code=401, detail="邮箱或密码不正确")
        return _token(request, user)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser = Depends(current_user)):
    return UserOut(id=user.id, email=user.email, display_name=user.display_name, is_guest=user.is_guest)


@router.post('/guest', response_model=TokenOut, status_code=201)
def guest(request: Request):
    try:
        workspace = request.app.state.guest_sessions.create()
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    token = create_token(workspace.id, request.app.state.settings.jwt_secret, ttl_hours=12)
    return TokenOut(access_token=token, user=UserOut(id=workspace.id, email='', display_name='访客', is_guest=True))


class EndGuestRequest(StrictModel):
    token: str = Field(min_length=1, max_length=4096)


@router.post('/guest/end', status_code=204)
def end_guest(body: EndGuestRequest, request: Request):
    ident = decode_token(body.token, request.app.state.settings.jwt_secret)
    if ident and not ident.startswith('guest_'):
        raise HTTPException(status_code=403, detail='此操作仅用于访客会话。')
    if ident:
        request.app.state.guest_sessions.close(ident)
    return Response(status_code=204)
