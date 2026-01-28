/// <reference types="vite/client" />

// Khai báo cho CSS Modules
declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

// Khai báo cho CSS thường (nếu có dùng)
declare module "*.css" {
  const content: string;
  export default content;
}
