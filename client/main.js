import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

import '../imports/startup/routes.js';

Meteor.startup(function() {
});

Template.MainLayout.events({
    'click #toggle-sound'(event) {
        event.preventDefault();
        const user = Meteor.user();
        if(user) {
            user.update({}, {$set: {enableSound: !user.profile.enableSound}});
        }
    },
});
