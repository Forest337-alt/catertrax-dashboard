interface Props {
  count: number
  onClick: () => void
}

export default function SoWhatButton({ count, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={[
        'relative flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border transition-all',
        count > 0
          ? 'bg-white text-primary-800 border-white hover:bg-white/90'
          : 'bg-white/10 text-white/90 border-white/20 hover:bg-white/20 hover:text-white hover:border-white/40',
      ].join(' ')}
    >
      <span>✦</span>
      <span>So What?</span>
      {count > 0 && (
        <span className="relative flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
          <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-red-500 text-white text-[10px] font-bold leading-none">
            {count > 9 ? '9+' : count}
          </span>
        </span>
      )}
    </button>
  )
}
