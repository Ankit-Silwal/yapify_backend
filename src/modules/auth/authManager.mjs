import bcrypt from "bcrypt";
import pool from "../../config/db";
import checkStrongPassword from '../../utils/strongpassword'

export const registerUsers=async (req,res)=>{
  const {email,password,conformPassword}=req.body;
  if(!email || !password || !conformPassword ){
    return res.status(400).json({
      success:false,
      message:"Please provide the all the required credentials as email,password and conformPassword"
    })
  }
  if(password!==conformPassword){
    return res.status(400).json({
      success:false,
      message:"The passwords didn't match with each other"
    })
  }
  const checkPassword=checkStrongPassword(password)
  if(!checkPassword){
    return res.status(400).json({
      success:false,
      message:checkPassword.errors.join(",")
    })
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
  const result = await pool.query(
    `
    INSERT INTO users (email, password_hash)
    VALUES ($1, $2)
    RETURNING id, email
    `,
    [email, hashedPassword]
  );
  res.status(201).json({
    success: true,
    data: result.rows[0]
  });

} catch (err) {
  if (err)
    return res.status(409).json({
      success: false,
      message: "Email already exists"
    });
  }

  throw err;
}

export const loginUser=async (req,res)=>{
  const {email,password}=req.body;
  if(!email || !password){
    return res.status(400).json({
      success:false,
      message:"Please provide both the email and the password"
    })
  }
  const result=await pool.query(
    `SELECT id,email,password_hash
    FROM users
    WHERE email=$1`,
    [email]
  )
  if(result.rows.length===0){
    return res.status(400).json({
      success:false,
      message:"Invalid email or password "
    })
  }
  const isMatch=await bcrypt.compare(password,user.password_hash);
  if(!isMatch){
    return res.status(400).json({
      success:false,
      message:"The password didn't match"
    })
  }
  return res.status(200).json({
    success:true,
    message:"Successfully logged in:)",
    user:{
      id:user.id,
      email:user.email
    }
  })
}