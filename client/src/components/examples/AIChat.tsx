import AIChat from '../AIChat'

export default function AIChatExample() {
  return (
    <div className="h-screen p-6 bg-background">
      <AIChat onPreferencesConfirmed={(pref) => console.log('Preferences:', pref)} />
    </div>
  )
}
