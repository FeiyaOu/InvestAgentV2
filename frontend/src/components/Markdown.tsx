import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Model-written text is rendered as Markdown with raw HTML disabled; links open in a new tab. */
export function Markdown({ text, className = "md-body" }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => {
            const safe = typeof href === "string" && /^https?:\/\//.test(href) ? href : undefined;
            return safe ? (
              <a href={safe} target="_blank" rel="noreferrer noopener">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
