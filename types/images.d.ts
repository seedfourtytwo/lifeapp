/** Metro turns a bundled image into an asset id that `<Image source>` takes. */
declare module '*.png' {
  const asset: number;
  export default asset;
}
