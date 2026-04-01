const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'controllers', 'SolicitudController.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

console.log(`Total lines antes: ${lines.length}`);

// La segunda copia rota comienza en línea 1158 (índice 1157)
// y termina en la siguiente línea que dice "generarFormularioBuffer"
// Buscar desde línea 1157 hasta encontrar "Versión buffer de generarPDF"
let startDel = 1157; // índice 0, la línea "     try {"
let endDel = -1;

for (let i = startDel; i < lines.length; i++) {
  if (lines[i].includes('Versión buffer de generarPDF')) {
    endDel = i - 2; // 2 lines before: the blank line and the closing brace
    console.log(`Encontrado fin en línea ${i + 1}: [${lines[i]}]`);
    break;
  }
}

if (endDel === -1) {
  console.log('No se encontró el fin. Buscando "generarFormularioBuffer"...');
  for (let i = startDel; i < lines.length; i++) {
    if (lines[i].includes('async generarFormularioBuffer')) {
      endDel = i - 2;
      console.log(`Encontrado en línea ${i + 1}`);
      break;
    }
  }
}

console.log(`Eliminando líneas ${startDel + 1} a ${endDel + 1}...`);
console.log(`Primera: [${lines[startDel]}]`);
console.log(`Última:  [${lines[endDel]}]`);

const newLines = [...lines.slice(0, startDel), ...lines.slice(endDel + 1)];
fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
console.log(`¡Listo! Total ahora: ${newLines.length} líneas`);
process.exit(0);
