"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const currencyFormat = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

export function RevenueChart({ data }: { data: { month: string; revenue: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#c7a15a" stopOpacity={0.75} />
              <stop offset="95%" stopColor="#c7a15a" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#dfe7ef" />
          <XAxis dataKey="month" stroke="#5d6470" />
          <YAxis stroke="#5d6470" tickFormatter={(value) => `PKR ${value / 1000000}M`} />
          <Tooltip
            formatter={(value) => [
              typeof value === "number" ? currencyFormat.format(value) : String(value ?? ""),
              "Revenue",
            ]}
          />
          <Area type="monotone" dataKey="revenue" stroke="#c7a15a" fill="url(#revenueFill)" strokeWidth={3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LeadChart({ data }: { data: { month: string; leads: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dfe7ef" />
          <XAxis dataKey="month" stroke="#5d6470" />
          <YAxis stroke="#5d6470" allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="leads" fill="#1d4d7a" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PerformanceChart({ data }: { data: { name: string; revenue: number; conversion: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dfe7ef" />
          <XAxis dataKey="name" stroke="#5d6470" />
          <YAxis stroke="#5d6470" />
          <Tooltip
            formatter={(value, name) => [
              name === "revenue" && typeof value === "number"
                ? currencyFormat.format(value)
                : String(value ?? ""),
              name === "revenue" ? "Revenue" : "Completed deals",
            ]}
          />
          <Legend />
          <Line type="monotone" dataKey="revenue" stroke="#c7a15a" strokeWidth={3} />
          <Line type="monotone" dataKey="conversion" stroke="#1d4d7a" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistributionChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={90} paddingAngle={4}>
            {data.map((entry, index) => (
              <Cell key={`${entry.name}-${index}`} fill={index % 2 === 0 ? "#1d4d7a" : "#c7a15a"} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
