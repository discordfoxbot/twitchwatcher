module.exports = function (sequelize, Sequelize) {
    return sequelize.define('TwitchChannel', {
        id: {type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, unique: true, autoIncrement: true},
        api_url: {type: Sequelize.STRING(191), allowNull: false, unique: true},
        channel: {type: Sequelize.STRING(100), allowNull: false, unique: true},
        status: {type: Sequelize.BOOLEAN, defaultValue: false},
        stream_id: {type:Sequelize.BOOLEAN, allowNull:true}
    }, {
        underscored: true,
        tableName: 'twitchchannels'
    })
};