interface Props {
  count: number
  onClick: () => void
}

export default function SoWhatButton({ count, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-30 flex items-center gap-2 bg-primary-800 text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg hover:bg-primary-700 active:scale-95 transition-all"
    >
      <span>So What?</span>
      {count > 0 && (
        <span className="bg-danger-500 text-white text-xs font-bold min-w-[1.25rem] h-5 flex items-center justify-center rounded-full px-1">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}
