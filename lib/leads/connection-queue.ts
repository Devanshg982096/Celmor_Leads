export interface ConnectionQueueItem {
  id: string;
  linkedin_url: string;
  status: "draft" | "queued" | "processing" | "done" | "failed" | "cancelled";
  created_at: string;
  error: string | null;
  lead_id: string | null;
}
export const QUEUE_LABELS = { draft: "Saved", queued: "Waiting", processing: "Fetching", done: "Added · Connection sent", failed: "Needs attention", cancelled: "Removed" };
