import { FileText, ClipboardCheck, CheckCircle, AlertTriangle } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentAssessments } from "@/components/dashboard/RecentAssessments";
import { BloomDistribution } from "@/components/dashboard/BloomDistribution";

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Overview of assessment moderation activity</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileText} title="Total Assessments" value={24} subtitle="This semester" variant="primary" />
        <StatCard icon={ClipboardCheck} title="Pending Review" value={7} subtitle="Awaiting moderation" variant="warning" />
        <StatCard icon={CheckCircle} title="Approved" value={15} subtitle="62.5% approval rate" variant="success" />
        <StatCard icon={AlertTriangle} title="Flagged Issues" value={12} subtitle="Across all assessments" variant="destructive" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RecentAssessments />
        </div>
        <div className="lg:col-span-2">
          <BloomDistribution />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
