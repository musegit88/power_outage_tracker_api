import outageService from "../services/outageService";
import cron from "node-cron";

const task = cron.schedule("0 3 * * *", async () => {
  console.log("Starting archiving resolved outages....");
  try {
    const archived = await outageService.archiveResolvedOutages();
    console.log(`Archived ${archived} outages`);
  } catch (error) {
    console.log("Failed to archive outage:", error);
  }
});

console.log("Next outage archiving will run at:", task.getNextRun());

export default cron;
