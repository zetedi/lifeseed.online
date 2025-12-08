import { Moon, Sun } from "lucide-react"
import { SimpleButton } from "@/components/SimpleButton"
import { useTheme } from "@/components/ThemeProvider"
import { useEffect, useState } from "react"

export function ModeToggle() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Fix hydration mismatch on first render
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const isDark = theme === "dark"

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark")
  }

  return (
    <SimpleButton
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className="relative"
    >
      <Sun
        className={`absolute h-[1.2rem] w-[1.2rem] transition-opacity ${
          isDark ? "opacity-0" : "opacity-100"
        }`}
      />
      <Moon
        className={`absolute h-[1.2rem] w-[1.2rem] transition-opacity ${
          isDark ? "opacity-100" : "opacity-0"
        }`}
      />
      <span className="sr-only">Toggle theme</span>
    </SimpleButton>
  )
}
