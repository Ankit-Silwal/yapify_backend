import "dotenv/config";
import app from "./app.ts";

const PORT = process.env.PORT || 5000;

app.listen(PORT,()=>{
  console.log(`The server is running on the port number ${PORT}`)
})
