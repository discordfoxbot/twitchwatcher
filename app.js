var request = require('request');
var Sequelize = require('sequelize');
var path = require('path');
var CronJob = require('cron').CronJob;
var Redis = require('ioredis');
var storyboard = require('storyboard');

storyboard.addListener(require('storyboard/lib/listeners/console').default);

var story = storyboard.mainStory;

var config = require('./config');

config.db.options.logging = (toLog)=> {
    story.debug('SQL', toLog);
};

var redis = new Redis(config.redis);
var sub = new Redis(config.redis);
var sequelize = new Sequelize(config.db.database, config.db.username, config.db.password, config.db.options);

var models = {
    TwitchWatcher: sequelize.import(path.join(__dirname, 'sql_models', 'TwitchWatcher')),
    TwitchChannel: sequelize.import(path.join(__dirname, 'sql_models', 'TwitchChannel'))
};

models.TwitchWatcher.belongsTo(models.TwitchChannel);
models.TwitchChannel.hasMany(models.TwitchWatcher);

sequelize.sync();

var cron = new CronJob('0 */5 * * * *', function () {
    story.info('Starting check.');
    models.TwitchChannel.findAll().then((channels)=> {
        channels.forEach((channel)=> {
            request.get(channel.api_url, {headers: {'Client-ID': config.api.twitch}}, (err, resp, body)=> {
                if (!err && [200, 304].indexOf(resp.statusCode) !== -1) {
                    body = JSON.parse(body);
                    if (channel.status && body.stream === null) {
                        channel.update({status: false, stream_id: null});
                        story.info('Channel ' + channel.channel + ' is now offline.');
                    } else if (!channel.status && body.stream !== null && channel.stream_id !== body.stream._id) {
                        channel.update({status: true, stream_id: body.stream._id}).then(()=> {
                            channel.getTwitchWatchers().then((watchers)=> {
                                redis.publish(config.redis.pubsub.prefix + 'events', JSON.stringify({
                                    type: 'twitchAnnounce',
                                    sid: '11111111',
                                    data: {
                                        channels: watchers.map((watcher)=> {
                                            return watcher.server_channel
                                        }),
                                        ch_name: body.stream.channel.display_name,
                                        ch_link: body.stream.channel.url,
                                        str_title: body.stream.channel.status,
                                        str_game: body.stream.game
                                    }
                                }));
                                story.info('Channel ' + channel.channel + ' is now online.')
                            });
                        });
                    }
                }
            })
        })
    });
}, null, true);

sub.subscribe(config.redis.pubsub.prefix + 'events');
sub.on('message', (channel, message)=> {
    story.info(channel, message);
});

story.info('Watcher started.');