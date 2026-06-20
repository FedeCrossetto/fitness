// Declaración ambiente para imports de imágenes en el typecheck standalone del
// paquete. En las apps el bundler (Vite/Metro) las resuelve; acá `tsc --noEmit`
// necesita saber que un `import x from '*.png'` es un string (URL en web).
declare module '*.png' {
  const value: string;
  export default value;
}
