const XLSX = require('xlsx');
const path = require('path');

// El archivo está en la raíz, el script en scratch/
const filePath = path.join(__dirname, '..', 'SP SIN CENTRO DE COSTO.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('Total rows:', data.length);
if (data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
    console.log('First row sample:', JSON.stringify(data[0], null, 2));
} else {
    console.log('Sheet is empty');
}
