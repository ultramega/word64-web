import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { Cookies } from 'meteor/ostrio:cookies';
import { Session } from 'meteor/session';

import '../imports/startup/routes.js';

Meteor.startup(function() {
    const soundCookie = new Cookies().get('enableSound') !== 'false';
    Session.set('enableSound', soundCookie == null || soundCookie);
});

Template.MainLayout.events({
    'click #toggle-sound'(event) {
        event.preventDefault();
        const current = Session.get('enableSound');
        Session.set('enableSound', !current);
        new Cookies().set('enableSound', !current);
    },
});

Template.MainLayout.helpers({
    enableSound() {
        return Session.get('enableSound');
    },
});
