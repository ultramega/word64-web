import { FlowRouter } from 'meteor/kadira:flow-router';
import { BlazeLayout } from 'meteor/kadira:blaze-layout';

FlowRouter.route('/', {
    name: 'home',
    action() {
        BlazeLayout.render('MainLayout', {main: 'HomePage'});
    },
});

FlowRouter.route('/play', {
    name: 'play',
    action() {
        BlazeLayout.render('MainLayout', {main: 'GamePage'});
    },
});

FlowRouter.route('/stats', {
    name: 'stats',
    action() {
        BlazeLayout.render('MainLayout', {main: 'StatsPage'});
    },
});
