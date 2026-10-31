// Все рендеры из src/assets/img доступны по имени файла без расширения: images['marina'].
const modules = import.meta.glob('../assets/img/*.{jpeg,jpg,png}', { eager: true });

export const images = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => [
    path.split('/').pop().replace(/\.\w+$/, ''),
    mod.default,
  ]),
);
