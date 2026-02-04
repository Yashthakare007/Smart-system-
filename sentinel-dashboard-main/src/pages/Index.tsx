import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { DashboardPanel } from "@/components/panels/DashboardPanel";
import { LiveFeedPanel } from "@/components/panels/LiveFeedPanel";
import { VideoInputPanel } from "@/components/panels/VideoInputPanel";
import { MobDetectionPanel } from "@/components/panels/MobDetectionPanel";
import { SuspiciousActivityPanel } from "@/components/panels/SuspiciousActivityPanel";
import { AlertsLogsPanel } from "@/components/panels/AlertsLogsPanel";

const Index = () => {
  const [activePanel, setActivePanel] = useState("dashboard");

  const renderPanel = () => {
    switch (activePanel) {
      case "dashboard":
        return <DashboardPanel />;
      case "live-feed":
        return <LiveFeedPanel />;
      case "video-input":
        return <VideoInputPanel />;
      case "mob-detection":
        return <MobDetectionPanel />;
      case "suspicious-activity":
        return <SuspiciousActivityPanel />;
      case "alerts-logs":
        return <AlertsLogsPanel />;
      default:
        return <DashboardPanel />;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar activePanel={activePanel} onPanelChange={setActivePanel} />
      <div className="flex-1 flex flex-col">
        <Header systemStatus="active" />
        <main className="flex-1 p-6 overflow-auto scrollbar-thin">
          {renderPanel()}
        </main>
      </div>
    </div>
  );
};

export default Index;
