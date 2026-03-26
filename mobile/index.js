/**
 * @format
 */

import 'react-native-get-random-values';
import { TextEncoder, TextDecoder } from 'text-encoding';
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

if (typeof global.TextEncoder === 'undefined') {
	global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
	global.TextDecoder = TextDecoder;
}

AppRegistry.registerComponent(appName, () => App);
