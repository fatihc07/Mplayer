import { ViewType } from '../../types'
import { ShoppingBag, Heart, Radio, Compass } from 'lucide-react'

const META: Record<string, { Icon: React.FC<any>; title: string; sub: string }> = {
  store:  { Icon: ShoppingBag, title: 'Store',  sub: 'Music store coming soon' },
  like:   { Icon: Heart,       title: 'Liked',  sub: 'Your liked songs will appear here' },
  radio:  { Icon: Radio,       title: 'Radio',  sub: 'Radio feature coming soon' },
  browse: { Icon: Compass,     title: 'Browse', sub: 'Discover feature coming soon' }
}

export function PlaceholderView({ view }: { view: ViewType }): JSX.Element {
  const m = META[view] ?? META.browse
  return (
    <div className="empty-view">
      <m.Icon size={48} className="empty-icon" />
      <p>{m.title}</p>
      <p className="sub">{m.sub}</p>
    </div>
  )
}
