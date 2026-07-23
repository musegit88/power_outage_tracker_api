import tokenService from "../services/tokenService"
import cron from "node-cron"


const task = cron.schedule("0 3 * * *", async () => {
    console.log("🧹 Starting scheduled token cleanup...")
    try {
        const deleted = await tokenService.cleanupExpiredTokens()
        console.log(`🧹 Cleaned up ${deleted} expired/old refresh tokens`)
    } catch (error) {
        console.error("❌ Token cleanup failed:", error)
    }
})

console.log("Next token cleanup will run at:", task.getNextRun());


export default cron