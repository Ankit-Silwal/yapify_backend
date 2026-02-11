import { createClient } from "redis";
const REDIS_URL=process.env.REDIS_URL;
const REDIS_CLIENT=createClient({
  url:REDIS_URL
})

let isRedisAvailable = false;
let errorShown = false;

REDIS_CLIENT.on("error",(err)=>{
  if (!errorShown) {
    console.error("⚠️  ERROR: Please start the Redis server");
    console.error(`Redis URL: ${process.env.REDIS_URL}`);
    errorShown = true;
  }
  isRedisAvailable = false;
})
REDIS_CLIENT.on("ready",()=>{
  console.log("✅ The redis server has finally started")
  isRedisAvailable = true;
  errorShown = false; // Reset flag when connected
})

export async function initRedis() {
  try {
    if(!REDIS_CLIENT.isOpen){
      await REDIS_CLIENT.connect();
      isRedisAvailable = true;
    }
  } catch (error) {
    console.error("⚠️  ERROR: Please start the Redis server");
    console.error("Running without Redis - sessions will be in-memory only");
    isRedisAvailable = false;
  }
}

export function isRedisConnected(): boolean {
  return isRedisAvailable && REDIS_CLIENT.isOpen;
}

export default REDIS_CLIENT;