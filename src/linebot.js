'use strict';

const apiai = require('apiai');
const uuid = require('node-uuid');
const request = require('request');

module.exports = class LineBot {

    get apiaiService() {
        return this._apiaiService;
    }

    set apiaiService(value) {
        this._apiaiService = value;
    }

    get botConfig() {
        return this._botConfig;
    }

    set botConfig(value) {
        this._botConfig = value;
    }

    get sessionIds() {
        return this._sessionIds;
    }

    set sessionIds(value) {
        this._sessionIds = value;
    }

    constructor(botConfig) {
        this._botConfig = botConfig;
        var apiaiOptions = {
            language: botConfig.apiaiLang,
            requestSource: "line"
        };

        this._apiaiService = apiai(botConfig.apiaiAccessToken, apiaiOptions);
        this._sessionIds = new Map();
    }

    processMessage(message, res) {
        if (this._botConfig.devConfig) {
            console.log("messages", message);
        }

        if (message.postback) {
            console.log("didalam postback if", message);
            message.message = {
                text : message.postback.data
            };
        }

        if (message.message.type) {
            if (message.message.type === "location") {
                console.log("location",message.message)
                this.messageForLocation(message.source.userId,message.message.latitude,message.message.longitude,message.replyToken);
            }
        }
        if (message.source.userId && message.message.text) {

            console.log("message if else ", message);

            let chatId = message.source.userId;
            var messageText = message.message.text;
            let token = message.replyToken;


            if (messageText) {
                // if (!this._sessionIds.has(chatId)) {
                //     this._sessionIds.set(chatId, uuid.v1());
                // }

                this.getUserName(chatId,(username)=> {
                    let apiaiRequest = this._apiaiService.textRequest(messageText,
                        {
                            sessionId: chatId,
                            contexts: [
                                {
                                    name: "generic",
                                    parameters: {
                                        facebook_user_name: username
                                    }
                                }
                            ]
                        });

                    apiaiRequest.on('response', (response) => {
                        console.log(JSON.stringify(response, null, 2));
                        if (LineBot.isDefined(response.result)) {
                            let responseText = response.result.fulfillment.speech;

                            if (response.result.fulfillment.data) {
                                console.log("data");
                                this.postLineRichMessage(token, chatId, response.result.fulfillment.data.line);
                            } else {
                                if (!responseText) {
                                    console.log("fulfilmentmessage");
                                    var messages = response.result.fulfillment.messages[0];
                                    this.postLineRichMessage(token, chatId, messages.payload.line);
                                } else {
                                    console.log("data lain lain");
                                    if (LineBot.isDefined(responseText)) {
                                        console.log('Response as text message');
                                        this.postLineMessage(token, chatId, responseText);
                                    } else {
                                        console.log('Received empty speech');
                                    }
                                }
                            }
                        } else {
                            console.log('Received empty result')
                        }
                    });

                    apiaiRequest.on('error', (error) => console.error(error));
                    apiaiRequest.end();
                });
            } else {
                console.log('Empty message');
            }
        }
        else {
            console.log("message di else ", message);
        }
    }

    messageForLocation(sessionId,lat,long,token){

        let eventObject = {
            sender: {
                id : sessionId
            },
            postback: {
                payload: "FACEBOOK_LOCATION",
                data: {
                    lat : lat,
                    long : long
                }
            }
        };

        let event  = {
            name: "FACEBOOK_LOCATION",
            data: {
                lat : lat,
                long : long
            }
        }

        this.getUserName(sessionId,(username)=>{
            var options = {
                sessionId :  sessionId,
                originalRequest: {
                    data: eventObject,
                    source: "line"
                },contexts : [
                    {
                        name : "generic",
                        parameters : {
                            facebook_user_name : username
                        }
                    }
                ]
            };

            let apiaiRequest = this._apiaiService.eventRequest(event,options);
            apiaiRequest.on('response', (response) => {
                console.log(response);
                if (LineBot.isDefined(response.result)) {
                    let responseText = response.result.fulfillment.speech;

                    if (response.result.fulfillment.data || null) {
                        this.postLineRichMessage(token, sessionId, response.result.fulfillment.data.line);
                    } else {
                        if (LineBot.isDefined(responseText)) {
                            console.log('Response as text message');
                            this.postLineMessage(token, sessionId, responseText);
                        } else {
                            console.log('Received empty speech');
                        }
                    }
                } else {
                    console.log('Received empty result');
                }
            });
            apiaiRequest.on('error', (error) => console.error(error));
            apiaiRequest.end();
        });
    }

    postLineRichMessage(token, to, payload) {
        console.log("INI DATA APPS", JSON.stringify(payload, null, 2));
        request.post("https://api.line.me/v2/bot/message/reply", {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + 'yUjmJ7BObmKI9Ii/XG6cs5okqYETch9e+AufuCLX7v08QphpEoQh6Qbk0bUiuQGRvk9QC58j3djI/vSGcUL2i8fhlA3ukdMo0NYSqEvm0lRbnyWDKmLNjrOJtug9A0ETUPI57EweFKjYOUwodAF+xQdB04t89/1O/w1cDnyilFU=',
            },
            json: {
                replyToken: token,
                messages: [payload]
            }
        }, function (error, response, body) {
            if (error) {
                console.error('Error while sending message', error);
                return;
            }
            if (response.statusCode != 200) {
                console.error('Error status code while sending message', body);
                return;
            }
            console.log('Send message succeeded');
        });
    }

    postLineMessage(token, to, text) {
        request.post("https://api.line.me/v2/bot/message/reply", {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + 'yUjmJ7BObmKI9Ii/XG6cs5okqYETch9e+AufuCLX7v08QphpEoQh6Qbk0bUiuQGRvk9QC58j3djI/vSGcUL2i8fhlA3ukdMo0NYSqEvm0lRbnyWDKmLNjrOJtug9A0ETUPI57EweFKjYOUwodAF+xQdB04t89/1O/w1cDnyilFU=',
            },
            json: {
                replyToken: token,
                messages: [
                    {
                        type: "text",
                        text: text
                    }
                ]
            }
        }, function (error, response, body) {
            if (error) {
                console.error('Error while sending message', error);
                return;
            }
            if (response.statusCode != 200) {
                console.error('Error status code while sending message', body);
                return;
            }
            console.log('Send message succeeded');
        });
    }

    getUserName(userid,callback){
        request.get("https://api.line.me/v2/bot/profile/"+userid,{
            headers: {
                'Authorization': 'Bearer ' + 'yUjmJ7BObmKI9Ii/XG6cs5okqYETch9e+AufuCLX7v08QphpEoQh6Qbk0bUiuQGRvk9QC58j3djI/vSGcUL2i8fhlA3ukdMo0NYSqEvm0lRbnyWDKmLNjrOJtug9A0ETUPI57EweFKjYOUwodAF+xQdB04t89/1O/w1cDnyilFU=',
            },json : true
        },function (error,response,body) {
            console.log('Send message succeeded',body);
            if (error) {
                console.error('Error while sending message', error);
                return;
            }
            if (response.statusCode != 200) {
                console.error('Error status code while sending message', body);
                return;
            }
            console.log('Send message succeeded',body);
            callback(body);
        });
    }

    static isDefined(obj) {
        if (typeof obj == 'undefined') {
            return false;
        }

        if (!obj) {
            return false;
        }

        return obj != null;
    }
}