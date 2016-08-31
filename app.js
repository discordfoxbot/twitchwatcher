var request = require('request');
var CronJob = require('cron').CronJob;
var storyboard = require('storyboard');
var DB = require('db');

storyboard.addListener(require('storyboard/lib/listeners/console').default);

var story = storyboard.mainStory;

var config = require('./config');

var db = new DB(config.db);

var cron = new CronJob('0 */5 * * * *', function () {
    story.info('Starting check.');
   db.models.TwitchChannel.findAll().then((channels)=> {
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
                                db.sendEvent('twitchAnnounce',{
                                    channels: watchers.map((watcher)=> {
                                        return watcher.server_channel
                                    }),
                                    ch_name: body.stream.channel.display_name,
                                    ch_link: body.stream.channel.url,
                                    str_title: body.stream.channel.status,
                                    str_game: body.stream.game
                                });
                                story.info('Channel ' + channel.channel + ' is now online.')
                            });
                        });
                    }
                }
            })
        })
    });
}, null, true);

story.info('Watcher started.');