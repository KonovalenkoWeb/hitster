import Home from '../Home'

export default function HomeExample() {
  return (
    <Home 
      onSelectMasterLocal={() => console.log('Master local selected')}
      onSelectMasterOnline={() => console.log('Master online selected')}
      onSelectPlayer={() => console.log('Player selected')}
    />
  )
}
