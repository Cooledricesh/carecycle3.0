'use client';

import { FilterProvider } from "@/providers/filter-provider";
import { FilterBar } from "@/components/filters/FilterBar";
import DashboardContent from "./dashboard-content";

export default function DashboardPage() {
  return (
    <FilterProvider persistToUrl={true}>
      <div className="space-y-4 sm:space-y-6">
        {/* Filter Bar */}
        <FilterBar
          collapsible={false}
          showTitle={true}
          className="mb-4"
        />

        {/* Dashboard Content */}
        <DashboardContent />
      </div>
    </FilterProvider>
  );
}