export default function KeyBadge({ children }: { children: string }) {
  return <span className="ml-1.5 align-middle text-[10px] font-normal opacity-70">[{children}]</span>;
}
