import { Store } from 'vuex';
import * as Api from './api';
import markdown from './markdown';

const searchWorker = new Worker('/search.worker.js');

searchWorker.onmessage = function (e) {
    store.commit('searchResults', e.data);
};

const store = new Store({
    state: {
        manifest: null,
        rawManifest: null,
        index: null,
        versionHash: null,
        entityCount: null,
        options: null,

        loadingData: false,

        markdown: null,

        searchTerm: '',
        searchResults: [],
    },
    mutations: {
        data(state, { manifest, index, hash, options }) {
            state.rawManifest = manifest;
            state.manifest = Object.fromEntries(manifest.map((e) => [e.id, e]));
            state.index = index;
            state.versionHash = hash;
            state.options = options;

            state.entityCount = Object.keys(manifest).length;

            state.loadingData = false;

            state.markdown = markdown(state.manifest);
        },

        loading(state) {
            state.loadingData = true;
        },

        searchTerm(state, s) {
            state.searchTerm = s;
        },
        searchResults(state, r) {
            state.searchResults = r;
        },
    },
    actions: {
        async loadData({ commit, dispatch }) {
            if (localStorage.casper) {
                let data = JSON.parse(localStorage.casper);

                commit('data', data);
                console.log('Loaded saved data');

                dispatch('prime');

                await dispatch('refreshData');
            } else {
                console.log('No data saved! Downloading new data...');
                await dispatch('getNewData');
            }
        },

        async refreshData({ state, dispatch }) {
            if (!state.versionHash) {
                console.log('No data saved! Downloading new data...');
                await dispatch('getNewData');
            } else {
                // get curent version hash from api
                const remoteHash = await Api.getHash();

                if (state.versionHash != remoteHash) {
                    console.log('Hashes do not match! Downloading new data...');
                    await dispatch('getNewData');
                }
            }
        },

        async getNewData({ commit, dispatch }) {
            commit('loading');

            const data = await Api.getData();

            commit('data', data);

            dispatch('prime');

            localStorage.casper = JSON.stringify(data);
        },

        prime({ state }) {
            searchWorker.postMessage({
                fuse: JSON.stringify({
                    values: state.rawManifest,
                    options: state.options.searchOptions,
                    index: state.index,
                }),
            });
        },

        search({ commit, state }) {
            if (state.searchTerm) {
                searchWorker.postMessage(state.searchTerm);
            } else {
                searchWorker.postMessage({ reset: true });
                commit('searchResults', []);
            }
        },
    },
});

export default store;
