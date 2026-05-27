import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import './hljs-light.css'

export default function MarkdownRenderer({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-p:my-1 prose-hr:hidden prose-blockquote:my-1 prose-pre:my-2 prose-pre:p-0 prose-pre:rounded-none prose-code:text-xs prose-code:text-[var(--app-text)] prose-pre:bg-[var(--app-code-bg)] prose-pre:text-[var(--app-text)] prose-pre:border prose-pre:border-[var(--app-border)] prose-pre:shadow-none prose-pre:ring-0 prose-a:text-[var(--app-text)] prose-headings:text-[var(--app-text)] prose-p:text-[var(--app-text)] prose-li:text-[var(--app-text)] prose-strong:!text-[var(--app-text)] prose-blockquote:text-[var(--app-text)] prose-th:text-[var(--app-text)] prose-td:text-[var(--app-text)] break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
