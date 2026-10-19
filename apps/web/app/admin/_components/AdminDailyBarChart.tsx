import adminStyles from "../admin.module.css"

export type AdminChartSeries = {
  label: string
  color: string
  dailyValues: number[]
  formatValue: (value: number) => string
}

const chartWidth = 900
const chartHeight = 260
const leftAxisWidth = 56
const bottomAxisHeight = 26
const topPadding = 10

function shortDayLabel(dayKey: string): string {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${monthNames[Number(dayKey.slice(5, 7)) - 1]} ${Number(dayKey.slice(8, 10))}`
}

function niceCeiling(maximumValue: number): number {
  if (maximumValue <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(maximumValue))
  const normalizedMaximum = maximumValue / magnitude
  const niceSteps = [1, 2, 4, 5, 6, 8, 10]
  return (niceSteps.find((niceStep) => niceStep >= normalizedMaximum) ?? 10) * magnitude
}

export default function AdminDailyBarChart({
  dayKeys,
  primarySeries,
  secondarySeries,
  sharedScale = false
}: {
  dayKeys: string[]
  primarySeries: AdminChartSeries
  secondarySeries?: AdminChartSeries
  sharedScale?: boolean
}) {
  const plotWidth = chartWidth - leftAxisWidth
  const plotHeight = chartHeight - bottomAxisHeight - topPadding
  const primaryMaximum = Math.max(0, ...primarySeries.dailyValues)
  const secondaryMaximum = secondarySeries ? Math.max(0, ...secondarySeries.dailyValues) : 0
  const primaryCeiling = niceCeiling(sharedScale ? Math.max(primaryMaximum, secondaryMaximum) : primaryMaximum)
  const secondaryCeiling = sharedScale ? primaryCeiling : niceCeiling(secondaryMaximum)
  const slotWidth = plotWidth / Math.max(1, dayKeys.length)
  const seriesCount = secondarySeries ? 2 : 1
  const barWidth = Math.max(2, Math.min(14, (slotWidth * 0.7) / seriesCount))
  const labelEvery = Math.max(1, Math.ceil(dayKeys.length / 8))
  const gridFractions = [0, 0.5, 1]

  const barsForSeries = (series: AdminChartSeries, ceiling: number, seriesIndex: number) =>
    series.dailyValues.map((dailyValue, dayIndex) => {
      if (dailyValue <= 0) return null
      const barHeight = (dailyValue / ceiling) * plotHeight
      const slotCenter = leftAxisWidth + slotWidth * dayIndex + slotWidth / 2
      const barLeft = slotCenter - (barWidth * seriesCount) / 2 + barWidth * seriesIndex
      return (
        <rect
          key={`${series.label}-${dayKeys[dayIndex]}`}
          x={barLeft}
          y={topPadding + plotHeight - barHeight}
          width={barWidth - 1}
          height={barHeight}
          rx={1.5}
          fill={series.color}
        >
          <title>{`${shortDayLabel(dayKeys[dayIndex])}: ${series.formatValue(dailyValue)} ${series.label.toLowerCase()}`}</title>
        </rect>
      )
    })

  return (
    <div>
      <div className={adminStyles.chartLegend}>
        {[primarySeries, secondarySeries].filter(Boolean).map((series) => (
          <span key={series!.label}>
            <span className={adminStyles.legendSwatch} style={{ background: series!.color }} />
            {series!.label}
          </span>
        ))}
      </div>
      <svg className={adminStyles.chartSvg} viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img">
        {gridFractions.map((gridFraction) => {
          const gridY = topPadding + plotHeight - gridFraction * plotHeight
          return (
            <g key={gridFraction}>
              <line x1={leftAxisWidth} x2={chartWidth} y1={gridY} y2={gridY} stroke="#1f1f22" />
              <text x={leftAxisWidth - 8} y={gridY + 4} textAnchor="end" fontSize="12" fill="#8d8d93">
                {primarySeries.formatValue(primaryCeiling * gridFraction)}
              </text>
            </g>
          )
        })}
        {barsForSeries(primarySeries, primaryCeiling, 0)}
        {secondarySeries ? barsForSeries(secondarySeries, secondaryCeiling, 1) : null}
        {dayKeys.map((dayKey, dayIndex) =>
          dayIndex % labelEvery === 0 ? (
            <text
              key={dayKey}
              x={leftAxisWidth + slotWidth * dayIndex + slotWidth / 2}
              y={chartHeight - 6}
              textAnchor="middle"
              fontSize="12"
              fill="#8d8d93"
            >
              {shortDayLabel(dayKey)}
            </text>
          ) : null
        )}
      </svg>
    </div>
  )
}
