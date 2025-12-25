import pkg from "pg";
const {Pool}=pkg;
const connectDB=async()=>{
  try{
    const pool=new Pool({
      connectionString:process.env.POSTGRES_URL,
    })
    await pool.query("SELECT 1");
    console.log("Postgres was finally connected");
    return pool;
  }catch(err){
    console.error("There was error connecting to the POSTGRES",err);
    process.exit(1);
  }
}
export default connectDB;