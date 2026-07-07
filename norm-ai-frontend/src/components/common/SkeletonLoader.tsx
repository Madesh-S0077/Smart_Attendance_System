
interface SkeletonLoaderProps {
  type: "table" | "calendar" | "cards";
  rows?: number;
}

export default function SkeletonLoader({ type, rows = 5 }: SkeletonLoaderProps) {
  // Common shimmering class
  const shimmerClass = "animate-pulse bg-[#E2E8F0] rounded-xl";

  if (type === "cards") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="p-6 bg-white border border-[#E2E8F0] rounded-3xl shadow-sm flex items-center gap-4 h-24"
          >
            <div className={`w-12 h-12 flex-shrink-0 ${shimmerClass}`} />
            <div className="space-y-2 flex-1">
              <div className={`h-3 w-2/3 ${shimmerClass}`} />
              <div className={`h-5 w-1/2 ${shimmerClass}`} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === "calendar") {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-sm space-y-6">
        {/* Navigation */}
        <div className="flex justify-between items-center">
          <div className={`w-10 h-10 ${shimmerClass}`} />
          <div className={`w-40 h-6 ${shimmerClass}`} />
          <div className={`w-10 h-10 ${shimmerClass}`} />
        </div>
        {/* Days Header */}
        <div className="grid grid-cols-7 gap-3 mb-2">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx} className={`h-4 mx-auto w-10 ${shimmerClass}`} />
          ))}
        </div>
        {/* Grid Cells */}
        <div className="grid grid-cols-7 gap-3">
          {Array.from({ length: 35 }).map((_, idx) => (
            <div key={idx} className={`aspect-square w-full ${shimmerClass}`} />
          ))}
        </div>
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-3xl shadow-sm overflow-hidden p-6 space-y-4">
        {/* Table Filter Top */}
        <div className="flex justify-between items-center gap-4">
          <div className={`h-9 w-60 ${shimmerClass}`} />
          <div className={`h-9 w-40 ${shimmerClass}`} />
        </div>
        {/* Table Rows */}
        <div className="space-y-3 pt-4">
          {Array.from({ length: rows }).map((_, idx) => (
            <div key={idx} className="flex gap-4 items-center py-2">
              <div className={`h-6 flex-1 ${shimmerClass}`} />
              <div className={`h-6 w-24 ${shimmerClass}`} />
              <div className={`h-6 w-32 ${shimmerClass}`} />
              <div className={`h-6 w-20 ${shimmerClass}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
