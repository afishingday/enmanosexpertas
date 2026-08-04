// Fisher-Yates: baraja sin mutar el arreglo original.
export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Elige n elementos al azar, sin repetir, del arreglo dado.
export function pickRandom(arr, n = 1) {
  if (n > arr.length) {
    throw new Error(`Se pidieron ${n} elementos pero solo hay ${arr.length} disponibles.`)
  }
  return shuffle(arr).slice(0, n)
}

// Elige un único elemento al azar.
export function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Entero aleatorio en [min, max].
export function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}
