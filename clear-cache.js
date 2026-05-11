#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file)
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath)
      } else {
        fs.unlinkSync(curPath)
      }
    })
    fs.rmdirSync(folderPath)
  }
}

console.log('🧹 Limpando cache do Next.js e estilos...')

// Remove .next folder
const nextFolder = path.join(process.cwd(), '.next')
if (fs.existsSync(nextFolder)) {
  deleteFolderRecursive(nextFolder)
  console.log('✅ Cache .next removido')
} else {
  console.log('ℹ️  Pasta .next não encontrada')
}

// Remove node_modules/.cache if exists
const cacheFolder = path.join(process.cwd(), 'node_modules', '.cache')
if (fs.existsSync(cacheFolder)) {
  deleteFolderRecursive(cacheFolder)
  console.log('✅ Cache node_modules/.cache removido')
}

// Remove Tailwind cache
const tailwindCache = path.join(process.cwd(), '.next', 'cache')
if (fs.existsSync(tailwindCache)) {
  deleteFolderRecursive(tailwindCache)
  console.log('✅ Cache Tailwind removido')
}

console.log('🎉 Cache limpo com sucesso!')
console.log('💡 Execute: npm run dev ou yarn dev para reiniciar')
console.log('🎨 Se os estilos não aparecerem, limpe também o cache do navegador (Ctrl+Shift+R)')