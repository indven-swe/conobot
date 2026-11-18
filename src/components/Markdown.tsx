import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/CodeBlock";
import { openExternalUrl } from "@/services/persistence";

const components: Components = {
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children, node }) => {
    const text = String(children ?? "");
    const match = /language-([\w+#-]+)/.exec(className ?? "");
    const spansLines = node?.position
      ? node.position.start.line !== node.position.end.line
      : false;
    const isBlock = Boolean(match) || spansLines || text.includes("\n");
    if (!isBlock) {
      return <code className="font-mono">{children}</code>;
    }
    return <CodeBlock language={match?.[1] ?? "text"} code={text.replace(/\n$/, "")} />;
  },
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(event) => {
        if (!href) return;
        event.preventDefault();
        void openExternalUrl(href);
      }}
      title={href}
    >
      {children}
    </a>
  ),
  input: ({ type, checked, node: _node, ...rest }) =>
    type === "checkbox" ? (
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className="mr-1.5 h-3 w-3 translate-y-[1px] accent-mint-400"
        {...rest}
      />
    ) : (
      <input type={type} {...rest} />
    ),
};

export const Markdown = memo(function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
});
