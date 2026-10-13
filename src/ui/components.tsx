import React, { ReactNode, createContext, createElement, isValidElement, useContext, useRef, useState } from 'react'
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View, ViewStyle, useWindowDimensions } from 'react-native'
import { Art, ArtName, Px, Type } from './theme'
import { useNav } from './nav'
import { useAppState } from '../data/store'

/** Hard offset shadow like the brief's `box-shadow: 4px 4px 0`. */
export const shadow = (d = 4, color = Px.brown): ViewStyle => ({ boxShadow: `${d}px ${d}px 0 ${color}` } as ViewStyle)
export const frame = (bg = Px.creamLight, border = Px.brown, width = 3): ViewStyle => ({ backgroundColor: bg, borderColor: border, borderWidth: width })

export function Glyph({ rows, color = Px.brown, size = 20 }: { rows: string[]; color?: string; size?: number }) {
  const px = Math.floor(size / rows.length)
  return (
    <View style={{ width: px * rows.length, height: px * rows.length }} aria-hidden>
      {rows.map((r, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {[...r].map((c, x) => <View key={x} style={{ width: px, height: px, backgroundColor: c === '#' ? color : 'transparent' }} />)}
        </View>
      ))}
    </View>
  )
}

/** Pixel-art image scaled with nearest-neighbour so edges stay hard. */
export function ArtImg({ name, size, label }: { name: ArtName; size: number; label?: string }) {
  return <Image source={Art[name]} style={{ width: size, height: size, imageRendering: 'pixelated' } as any} accessibilityLabel={label} aria-hidden={!label} />
}

export const Label = ({ children, color = Px.brown, style }: { children: ReactNode; color?: string; style?: object }) =>
  <Text style={[Type.label, { color }, style]}>{typeof children === 'string' ? children.toUpperCase() : children}</Text>
export const Body = ({ children, color = Px.brown, style }: { children: ReactNode; color?: string; style?: object }) =>
  <Text style={[Type.body, { color }, style]}>{children}</Text>
export const Small = ({ children, color = Px.muted, style }: { children: ReactNode; color?: string; style?: object }) =>
  <Text style={[Type.small, { color }, style]}>{children}</Text>

/** Framed application window with an orange title strip. */
export function Window({ title, header = Px.orange, actions, children, style }: { title: string; header?: string; actions?: ReactNode; children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ width: '100%' }, shadow(), frame(), style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: header, minHeight: 36, paddingLeft: 10, paddingRight: 6 }}>
        <Text role="heading" style={[Type.title, { color: Px.creamLight, flex: 1 }]}>{title.toUpperCase()}</Text>
        {actions}
      </View>
      <View style={{ height: 3, backgroundColor: Px.brown }} />
      <View style={{ padding: 12, gap: 10 }}>{children}</View>
    </View>
  )
}

/** Window that folds to its title bar. Closed again whenever the screen is left. */
export function FoldWindow({ title, open = false, children }: { title: string; open?: boolean; children: ReactNode }) {
  const inSide = useContext(SideOpen)
  const [isOpen, setOpen] = useState(open || inSide)
  return (
    <View style={[{ width: '100%' }, shadow(), frame()]}>
      <Pressable
        onPress={() => setOpen(!isOpen)} role="button" aria-expanded={isOpen}
        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isOpen ? Px.orange : Px.cream, minHeight: 44, paddingHorizontal: 10 }}
      >
        <Text role="heading" style={[Type.title, { color: isOpen ? Px.creamLight : Px.brown, flex: 1 }]}>{title.toUpperCase()}</Text>
        <Text style={[Type.title, { color: isOpen ? Px.creamLight : Px.brown }]}>{isOpen ? '[-]' : '[+]'}</Text>
      </Pressable>
      {isOpen && <>
        <View style={{ height: 3, backgroundColor: Px.brown }} />
        <View style={{ padding: 12, gap: 10 }}>{children}</View>
      </>}
    </View>
  )
}

export type Kind = 'primary' | 'secondary' | 'danger'

/** Physical-feeling button: hard shadow that collapses when pressed. */
export function PixelButton({ text, onPress, kind = 'primary', enabled = true, glyph, art, style }: {
  text: string; onPress: () => void; kind?: Kind; enabled?: boolean; glyph?: string[]; art?: ArtName; style?: ViewStyle
}) {
  const bg = !enabled ? Px.cream : kind === 'primary' ? Px.orange : kind === 'danger' ? Px.red : Px.creamLight
  const fg = !enabled ? Px.muted : kind === 'secondary' ? Px.brown : Px.creamLight
  return (
    <Pressable onPress={onPress} disabled={!enabled} role="button" aria-disabled={!enabled}
      style={({ pressed }) => [
        { minHeight: 48, minWidth: 48, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
        frame(pressed && kind === 'primary' ? Px.orangeBright : bg),
        pressed ? { transform: [{ translateX: 3 }, { translateY: 3 }] } : enabled ? shadow(3) : {},
        style,
      ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {glyph && <Glyph rows={glyph} color={fg} size={16} />}
        {art && <ArtImg name={art} size={20} />}
        {!!text && <Text style={[Type.button, { color: fg }]}>{text.toUpperCase()}</Text>}
      </View>
    </Pressable>
  )
}

/** Label + value on one line, value right-aligned. */
export const KeyValue = ({ k, v, color = Px.brown }: { k: string; v: string; color?: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Body style={{ flex: 1 }}>{k}</Body>
    <Text style={[Type.body, { color }]}>{v}</Text>
  </View>
)

/** Old-dialog text field. Orange border and hard shadow while focused. */
export function PixelField({ value, onChange, label, placeholder = '', keyboard = 'default', error, multiline, style }: {
  value: string; onChange: (s: string) => void; label: string; placeholder?: string
  keyboard?: 'default' | 'decimal-pad' | 'number-pad' | 'email-address' | 'url'; error?: string | null; multiline?: boolean; style?: ViewStyle
}) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={[{ gap: 4 }, style]}>
      {!!label && <Label>{label}</Label>}
      <TextInput
        value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={Px.muted} multiline={multiline}
        keyboardType={keyboard} inputMode={keyboard === 'decimal-pad' ? 'decimal' : keyboard === 'number-pad' ? 'numeric' : undefined}
        aria-label={label || placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={[Type.body, frame(Px.creamLight, error ? Px.red : focused ? Px.orange : Px.brown), focused ? shadow(3) : {},
          { minHeight: 44, paddingHorizontal: 8, paddingVertical: 10, outlineStyle: 'none' } as any]}
      />
      {!!error && <Text style={[Type.small, { color: Px.red }]}>! {error}</Text>}
    </View>
  )
}

/** Segmented bar of blocks, like a retro loading bar. Text label carries the meaning; colour is a cue. */
export function PixelProgress({ fraction, color = Px.orange, blocks = 20, colors }: { fraction: number; color?: string; blocks?: number; colors?: string[] }) {
  const f = Math.min(Math.max(fraction, 0), 1) * blocks
  const filled = f > 0 && f < 1 ? 1 : Math.floor(f)
  return (
    <View role="progressbar" aria-valuenow={Math.round(fraction * 100)} style={[frame(Px.cream), { flexDirection: 'row', padding: 3, gap: 2 }]}>
      {Array.from({ length: blocks }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 14, backgroundColor: colors ? colors[i] ?? Px.creamLight : i < filled ? color : Px.creamLight }} />
      ))}
    </View>
  )
}

/** Slider drawn as a PixelProgress bar; moves in whole [step]s from 0 up to [max]. */
export function PixelSlider({ value, onChange, max, step, color = Px.blue }: { value: number; onChange: (v: number) => void; max: number; step: number; color?: string }) {
  const stops = Math.max(Math.floor(max / step), 0)
  const width = useRef(1)
  const at = (x: number) => Math.min(Math.max(Math.round((Math.min(Math.max(x / width.current, 0), 1) * max) / step), 0), stops) * step
  return (
    <View
      onLayout={(e) => { width.current = Math.max(e.nativeEvent.layout.width, 1) }}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => onChange(at(e.nativeEvent.locationX))}
      onResponderMove={(e) => onChange(at(e.nativeEvent.locationX))}
      role="slider" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}
      style={{ cursor: 'pointer' } as any}
    >
      <View pointerEvents="none"><PixelProgress fraction={max > 0 ? value / max : 0} color={color} blocks={Math.min(Math.max(stops, 1), 20)} /></View>
    </View>
  )
}

/** Square status chip with a symbol + word so state never relies on colour alone. */
export const Chip = ({ text, color, style }: { text: string; color: string; style?: ViewStyle }) => (
  <View style={[frame(color, Px.brown, 2), { paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start' }, style]}>
    <Text style={[Type.label, { color: [Px.cream, Px.creamLight, Px.yellow].includes(color) ? Px.brown : Px.creamLight }]}>{text.toUpperCase()}</Text>
  </View>
)

/** One-of-many picker drawn as a row of square tabs. */
export function Choice<T>({ options, selected, label, onSelect }: { options: T[]; selected: T | null | undefined; label: (t: T) => string; onSelect: (t: T) => void }) {
  return (
    <View role="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o, i) => {
        const on = o === selected
        return (
          <Pressable key={i} role="radio" aria-checked={on} onPress={() => onSelect(o)}
            style={[frame(on ? Px.orange : Px.creamLight, Px.brown, 2), { minHeight: 40, paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center' }]}>
            <Text style={[Type.label, { color: on ? Px.creamLight : Px.brown }]}>{label(o).toUpperCase()}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Date field using the browser's own date picker. Value is ISO yyyy-mm-dd. */
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  return (
    <View style={{ gap: 4 }}>
      <Label>{label}</Label>
      {createElement('input', {
        type: 'date', value, 'aria-label': label,
        onChange: (e: any) => e.target.value && onChange(e.target.value),
        style: { fontFamily: 'VT323', fontSize: 21, color: Px.brown, background: Px.creamLight, border: `3px solid ${Px.brown}`, minHeight: 44, padding: '6px 8px', boxSizing: 'border-box', width: '100%' },
      })}
    </View>
  )
}

export function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} role="button" aria-label="Close" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[frame(Px.creamLight, Px.brown, 2), { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[Type.title, { color: Px.brown }]}>X</Text>
      </View>
    </Pressable>
  )
}

/** Modal window. */
export function PixelDialog({ title, onDismiss, children }: { title: string; onDismiss: () => void; children: ReactNode }) {
  return (
    <Modal transparent visible onRequestClose={onDismiss}>
      <Pressable onPress={onDismiss} style={{ flex: 1, backgroundColor: 'rgba(16,23,47,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 480, maxHeight: '90%' }}>
          <Window title={title} actions={<CloseButton onPress={onDismiss} />}>
            <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 10 }}>{children}</ScrollView>
          </Window>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/** Decorative pixel rule. */
export const Rule = () => (
  <View style={{ flexDirection: 'row', gap: 4, overflow: 'hidden' }} aria-hidden>
    {Array.from({ length: 40 }, (_, i) => <View key={i} style={{ width: 4, height: 2, backgroundColor: i % 2 === 0 ? Px.brown : 'transparent' }} />)}
  </View>
)

/** Computers and tablets (900 px and wider) get the side-by-side dashboard layout. */
export const useWide = () => useWindowDimensions().width >= 900

const SideOpen = createContext(false)

/**
 * Secondary windows of a page. On a wide screen they move to a column on the right (and folds there start open);
 * on a phone they stay where they are in the page.
 */
export const Side = ({ children }: { children: ReactNode }) => <>{children}</>

/** Scrolling page body with larger gaps between windows than inside them. Splits into two columns on wide screens. */
export function Page({ children }: { children: ReactNode }) {
  const wide = useWide()
  const kids = React.Children.toArray(children)
  const isSide = (k: unknown) => isValidElement(k) && k.type === Side
  const pad = { paddingLeft: 14, paddingRight: 18, paddingTop: 16, paddingBottom: 24, width: '100%', alignSelf: 'center' } as const
  if (!wide || !kids.some(isSide)) {
    return <ScrollView style={{ flex: 1 }} contentContainerStyle={{ ...pad, gap: 20, maxWidth: wide ? 820 : 720 }}>{children}</ScrollView>
  }
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ ...pad, paddingHorizontal: 24, maxWidth: 1320, flexDirection: 'row', alignItems: 'flex-start', gap: 28 }}>
      <View style={{ flex: 3, minWidth: 0, gap: 20 }}>{kids.filter((k) => !isSide(k))}</View>
      <View style={{ flex: 2, minWidth: 0, gap: 20 }}><SideOpen.Provider value={true}>{kids.filter(isSide)}</SideOpen.Provider></View>
    </ScrollView>
  )
}

/** Page title row with a back button, for pushed screens. */
export function PageHeader({ title }: { title: string }) {
  const nav = useNav()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <PixelButton text="< Back" onPress={nav.back} kind="secondary" />
      <Text role="heading" style={[Type.hero, { flex: 1 }]}>{title.toUpperCase()}</Text>
    </View>
  )
}

/** A field-looking box that opens a picker. */
export const PickerBox = ({ text, onPress }: { text: string; onPress: () => void }) => (
  <Pressable onPress={onPress} role="button" style={[frame(), { minHeight: 44, paddingHorizontal: 8, paddingVertical: 10 }]}>
    <Body>{text}  ▾</Body>
  </Pressable>
)

/** Searchable list in a dialog. [options] are (value, label). */
export function SearchPicker({ title, options, onDismiss, onPick, allowCustom = false }: {
  title: string; options: [string, string][]; onDismiss: () => void; onPick: (v: string) => void; allowCustom?: boolean
}) {
  const [q, setQ] = useState('')
  const t = q.trim()
  return (
    <PixelDialog title={title} onDismiss={onDismiss}>
      <PixelField value={q} onChange={setQ} label="" placeholder="Search" />
      {allowCustom && !!t && !options.some(([v]) => v === t) && (
        <Pressable onPress={() => onPick(t)} style={{ minHeight: 44, padding: 6 }}><Body>Use "{t}"</Body></Pressable>
      )}
      {options.filter(([, l]) => !q || l.toLowerCase().includes(q.toLowerCase())).slice(0, 60).map(([v, l]) => (
        <Pressable key={v} onPress={() => onPick(v)} style={{ minHeight: 44, padding: 6 }}><Body>{l}</Body></Pressable>
      ))}
    </PixelDialog>
  )
}

/**
 * Your profile picture wherever the app shows a character: the photo you uploaded (Profile), otherwise the app icon.
 * The photo lives in the setup record, so it's the same on the phone and the web.
 */
export function Avatar({ size, label }: { size: number; label?: string }) {
  const photo = useAppState().setup?.avatar
  if (!photo) return <ArtImg name="app_icon" size={size} label={label} />
  return <Image source={{ uri: photo }} style={{ width: size, height: size }} accessibilityLabel={label ?? 'Profile picture'} />
}

/**
 * A picked picture as a small square data URL. Fully transparent edges are trimmed, then the whole picture is scaled
 * to fit the square (never cut); any space left over stays transparent. PNG when there's transparency, else JPEG.
 * It has to fit in one sheet cell to sync (50,000 characters), so a large one shrinks.
 */
export async function avatarFromFile(file: File): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  // Where the visible part is, measured on a copy at most 512 px wide.
  const k = Math.min(1, 512 / Math.max(bmp.width, bmp.height))
  const m = document.createElement('canvas')
  m.width = Math.max(1, Math.round(bmp.width * k)); m.height = Math.max(1, Math.round(bmp.height * k))
  const mg = m.getContext('2d')!
  mg.drawImage(bmp, 0, 0, m.width, m.height)
  const a = mg.getImageData(0, 0, m.width, m.height).data
  let x0 = m.width, y0 = m.height, x1 = -1, y1 = -1
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (a[(y * m.width + x) * 4 + 3] > 8) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = m.width - 1; y1 = m.height - 1 } // all transparent: keep it all
  const bx = x0 / k, by = y0 / k, bw = (x1 - x0 + 1) / k, bh = (y1 - y0 + 1) / k
  for (const size of [128, 96, 64]) {
    const c = document.createElement('canvas')
    c.width = c.height = size
    const g = c.getContext('2d')!
    const sc = size / Math.max(bw, bh), dw = bw * sc, dh = bh * sc
    g.drawImage(bmp, bx, by, bw, bh, (size - dw) / 2, (size - dh) / 2, dw, dh)
    const px = g.getImageData(0, 0, size, size).data
    let clear = false
    for (let i = 3; i < px.length; i += 4) if (px[i] < 255) { clear = true; break }
    const url = clear ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85)
    if (url.length < 45_000) return url
  }
  throw new Error('Picture too detailed to sync.')
}
