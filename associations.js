const Usuario = require('./models/Usuario');
const CajaChica = require('./models/CajaChica');
const GastoCajaChica = require('./models/GastoCajaChica');
const PagoDirecto = require('./models/PagoDirecto');
const DistribucionGasto = require('./models/DistribucionGasto');
const CentroCosto = require('./models/CentroCosto');
const ArqueoCajaChica = require('./models/ArqueoCajaChica');
const ReposicionCajaChica = require('./models/ReposicionCajaChica');
const Solicitud = require('./models/Solicitud');

const setupAssociations = () => {
    // CajaChica
    CajaChica.belongsTo(Usuario, { as: 'responsable', foreignKey: 'responsableId' });
    CajaChica.hasMany(GastoCajaChica, { foreignKey: 'cajaChicaId' });

    // GastoCajaChica
    GastoCajaChica.belongsTo(CajaChica, { foreignKey: 'cajaChicaId' });
    GastoCajaChica.belongsTo(Usuario, { as: 'responsable', foreignKey: 'responsableId' });
    GastoCajaChica.belongsTo(Usuario, { as: 'registrador', foreignKey: 'registradoPorId' });
    GastoCajaChica.hasMany(DistribucionGasto, { foreignKey: 'gastoCajaChicaId' });

    // PagoDirecto
    PagoDirecto.belongsTo(Usuario, { as: 'elaboradoPor', foreignKey: 'elaboradoPorId' });
    PagoDirecto.hasMany(DistribucionGasto, { foreignKey: 'pagoDirectoId' });

    // DistribucionGasto
    DistribucionGasto.belongsTo(CentroCosto, { foreignKey: 'centroCostoId' });
    DistribucionGasto.belongsTo(GastoCajaChica, { foreignKey: 'gastoCajaChicaId' });
    DistribucionGasto.belongsTo(PagoDirecto, { foreignKey: 'pagoDirectoId' });
    DistribucionGasto.belongsTo(Solicitud, { foreignKey: 'solicitudId' });

    // Solicitud
    Solicitud.hasMany(DistribucionGasto, { foreignKey: 'solicitudId', as: 'distribucionCentros' });

    // Arqueo
    ArqueoCajaChica.belongsTo(CajaChica, { foreignKey: 'cajaChicaId' });
    ArqueoCajaChica.belongsTo(Usuario, { as: 'elaboradoPor', foreignKey: 'elaboradoPorId' });

    // Reposicion
    ReposicionCajaChica.belongsTo(CajaChica, { foreignKey: 'cajaChicaId' });
};

module.exports = setupAssociations;
