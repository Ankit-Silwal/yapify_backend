import { configDotenv } from "dotenv";
import app from "./app.ts";

configDotenv();

const PORT=process.env.PORT || 5000;

app.listen(PORT,()=>{
  console.log(`The server is running on the port number ${PORT}`)
})
