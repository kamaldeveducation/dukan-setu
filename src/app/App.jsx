import '../App.css'
import AppRoutes from './routes.jsx'
import useAppController from './useAppController.js'

export default function App() {
  const controller = useAppController()
  return <AppRoutes {...controller} />
}