import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { formatAmount, formatMoney } from '@/utils/format.js';

const ROW_HEIGHT = 36;
// No colour here: each bar takes its category's colour, so ChartContainer injects no <style>.
const CONFIG = { total: { label: 'Spent' } };

/**
 * One currency's spending per category as horizontal bars in the category colours,
 * with the name and amount beside each bar. Screen readers get the same data as a list.
 */
export default function CategoryChart({ currency }) {
  const data = currency.categories.map((category) => ({ ...category, total: Number(category.total) }));
  return (
    <>
      <ChartContainer
        config={CONFIG} className="aspect-auto w-full text-sm" style={{ height: data.length * ROW_HEIGHT }}
        aria-hidden="true"
      >
        <BarChart data={data} layout="vertical" margin={{ top: 0, bottom: 0, left: 0, right: 88 }} barSize={12}>
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis
            type="category" dataKey="name" width={88} tickLine={false} axisLine={false}
            tick={CategoryTick}
          />
          <Bar dataKey="total" radius={6} isAnimationActive={false} background={{ className: 'fill-muted', radius: 6 }}>
            {data.map((category) => <Cell key={category.category_id} fill={category.color} />)}
            <LabelList dataKey="total" position="right" formatter={formatAmount} className="fill-foreground" />
          </Bar>
        </BarChart>
      </ChartContainer>
      <ul className="sr-only" aria-label={`${currency.currency} by category`}>
        {currency.categories.map((category) => (
          <li key={category.category_id}>
            <span>{category.name}</span> <span>{formatMoney(category.total, currency.currency)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Category name on the left edge of its row. */
function CategoryTick({ y, payload }) {
  return <text x={0} y={y} dy={5} className="fill-foreground">{payload.value}</text>;
}
