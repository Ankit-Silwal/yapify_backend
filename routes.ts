import type { Application } from 'express-serve-static-core'
import authRoutes from './src/modules/auth/authRoutes.js'

export const setupRoutes=(app:Application)=>{
  app.use('/api/auth',authRoutes)
}
