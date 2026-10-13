import { TextStyle } from 'react-native'

/** Nostelika palette (same as the Android app's Px). */
export const Px = {
  orange: '#F4512A',
  orangeBright: '#FF4B16',
  cream: '#E7D6AD',
  creamLight: '#F1E4C6',
  navy: '#10172F',
  brown: '#2B1D12',
  blue: '#2459A6',
  green: '#4A9A78',
  red: '#C93721',
  white: '#FFF4DC',
  yellow: '#F2C230', // dipping into savings
  muted: 'rgba(43,29,18,0.55)',
}

export const Fonts = {
  PressStart: require('../../assets/fonts/press_start.ttf'),
  Silkscreen: require('../../assets/fonts/silkscreen.ttf'),
  SilkscreenBold: require('../../assets/fonts/silkscreen_bold.ttf'),
  VT323: require('../../assets/fonts/vt323.ttf'),
}

/** Type roles from the brief. VT323 renders small, so body sizes run larger than usual. */
export const Type: Record<'hero' | 'number' | 'title' | 'label' | 'button' | 'body' | 'small', TextStyle> = {
  hero: { fontFamily: 'PressStart', fontSize: 20, lineHeight: 26, color: Px.brown },
  number: { fontFamily: 'PressStart', fontSize: 16, lineHeight: 22, color: Px.brown },
  title: { fontFamily: 'SilkscreenBold', fontSize: 13, letterSpacing: 0.5, lineHeight: 16 },
  label: { fontFamily: 'Silkscreen', fontSize: 11, letterSpacing: 0.5, lineHeight: 14, color: Px.brown },
  button: { fontFamily: 'SilkscreenBold', fontSize: 12, letterSpacing: 0.5, lineHeight: 14 },
  body: { fontFamily: 'VT323', fontSize: 21, lineHeight: 22, color: Px.brown },
  small: { fontFamily: 'VT323', fontSize: 18, lineHeight: 19, color: Px.brown },
}

/** 9×9 pixel glyphs ('#' = filled). */
export const Glyphs = {
  home: ['....#....', '...###...', '..#####..', '.#######.', '#########', '.#.....#.', '.#.##..#.', '.#.##..#.', '.#######.'],
  list: ['#########', '#.......#', '#.#.###.#', '#.......#', '#.#.###.#', '#.......#', '#.#.###.#', '#.......#', '#########'],
  coin: ['..#####..', '.#.....#.', '#..###..#', '#..#....#', '#..###..#', '#....#..#', '#..###..#', '.#.....#.', '..#####..'],
  person: ['...###...', '..#####..', '..#####..', '..#####..', '...###...', '.........', '.#######.', '#########', '#########'],
  plus: ['...###...', '...###...', '...###...', '#########', '#########', '#########', '...###...', '...###...', '...###...'],
  image: ['#########', '#.......#', '#.##....#', '#.##....#', '#.....#.#', '#....###.', '#...#####', '#.#######', '#########'],
  camera: ['.........', '..###....', '#########', '#...#...#', '#..###..#', '#..###..#', '#...#...#', '#########', '.........'],
  plane: ['....#....', '...###...', '...###...', '#########', '#########', '...###...', '...###...', '..#####..', '.........'],
  sync: ['..#####..', '.#.....#.', '#.......#', '#....####', '#.....##.', '.##.....#', '####....#', '.#.....#.', '..#####..'],
}

export const Art = {
  mascot_idle: require('../../assets/art/mascot_idle.png'),
  icon_coin: require('../../assets/art/icon_coin.png'),
  icon_star: require('../../assets/art/icon_star.png'),
  icon_airplane: require('../../assets/art/icon_airplane.png'),
  icon_camera: require('../../assets/art/icon_camera.png'),
  icon_receipt: require('../../assets/art/icon_receipt.png'),
  icon_suitcase: require('../../assets/art/icon_suitcase.png'),
  icon_money_bag: require('../../assets/art/icon_money_bag.png'),
  icon_heart: require('../../assets/art/icon_heart.png'),
  char_princess_face: require('../../assets/art/char_princess_face.png'),
  char_boy_face: require('../../assets/art/char_boy_face.png'),
}
export type ArtName = keyof typeof Art
