import { useEffect, useState } from "react";
import { Activity, Brain, Lightbulb } from "lucide-react";

import Tabs from "../../components/common/Tabs/Tabs";
import LeafyOverviewTab from "./tabs/LeafyOverviewTab";
import RecommendationsTab from "./tabs/RecommendationsTab";
import ActivityTab from "./tabs/ActivityTab";

import {
  getMoreLeafyActivity,
  getMoreLeafyRecommendations,
} from "../../services/leafyAiApi";
import styles from "./LeafyAI.module.css";

const tabs = [
  { id: "overview", label: "Overview", Icon: Brain },
  { id: "recommendations", label: "Recommendations", Icon: Lightbulb },
  { id: "activity", label: "Activity", Icon: Activity },
];

function LeafyAI({
  data = null,
  loading = false,
  error = "",
  token,
  onTokenRefresh,
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const hasError = Boolean(error);
  const [recommendations, setRecommendations] = useState([]);
  const [activity, setActivity] = useState([]);
  const [moreBusy, setMoreBusy] = useState(false);
  const [recommendationsMore, setRecommendationsMore] = useState(true);
  const [activityMore, setActivityMore] = useState(true);

  useEffect(() => {
    setRecommendations(
      Array.isArray(data?.recommendations) ? data.recommendations : [],
    );
    setActivity(Array.isArray(data?.activity) ? data.activity : []);
  }, [data]);

  async function loadMoreRecommendations() {
    setMoreBusy(true);
    try {
      const next = await getMoreLeafyRecommendations(
        token,
        onTokenRefresh,
        recommendations.length,
      );
      setRecommendations((current) => [...current, ...next]);
      setRecommendationsMore(next.length === 50);
    } finally {
      setMoreBusy(false);
    }
  }
  async function loadMoreActivity() {
    setMoreBusy(true);
    try {
      const next = await getMoreLeafyActivity(
        token,
        onTokenRefresh,
        activity.length,
      );
      setActivity((current) => [...current, ...next]);
      setActivityMore(next.length === 50);
    } finally {
      setMoreBusy(false);
    }
  }

  return (
    <div className={styles.leafyAI}>
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        ariaLabel="Leafy AI sections"
      />

      {activeTab === "overview" && (
        <LeafyOverviewTab data={data} loading={loading} error={hasError} />
      )}

      {activeTab === "recommendations" && (
        <RecommendationsTab
          data={recommendations}
          loading={loading}
          error={hasError}
          hasMore={recommendationsMore}
          loadingMore={moreBusy}
          onLoadMore={loadMoreRecommendations}
        />
      )}

      {activeTab === "activity" && (
        <ActivityTab
          data={activity}
          loading={loading}
          error={hasError}
          hasMore={activityMore}
          loadingMore={moreBusy}
          onLoadMore={loadMoreActivity}
        />
      )}
    </div>
  );
}

export default LeafyAI;
