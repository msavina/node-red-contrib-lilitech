/* global RED, $ */
// Funzioni dell'editor comuni ai nodi device: menu dei device caricato dalla headunit ed elenco degli items
window.LilitechEditor =
    window.LilitechEditor ||
    (function () {
        /*--------------------------------------------------------------------------------------------------------------
        --------------------------------------------------------------------------------------------------------------*/
        function showItems(items) {
            $('#node-input-lilitech-items').text(items && items.length ? items.join(', ') : '-');
        }

        /*--------------------------------------------------------------------------------------------------------------
            Carica l'elenco dei device della famiglia dalla headunit selezionata
        --------------------------------------------------------------------------------------------------------------*/
        function loadDevices(node, familyId) {
            const select = $('#node-input-deviceId');
            const headunitId = $('#node-input-headunit').val();
            const headunit = RED.nodes.node(headunitId);
            const current = select.val() || node.deviceId;
            const tip = $('#node-input-lilitech-tip');

            if (!headunit) {
                tip.text('Select or create a headunit first.');
                return;
            }
            tip.text('Loading devices...');
            $.getJSON('lilitech/devices', { familyId: familyId, config: headunitId, url: headunit.url })
                .done(function (devices) {
                    select.empty();
                    devices
                        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                        .forEach(function (d) {
                            $('<option/>')
                                .val(d.deviceId)
                                .text(`${d.name || d.deviceId} (${d.typeId})`)
                                .data('device', d)
                                .appendTo(select);
                        });
                    if (current && !devices.some((d) => d.deviceId === current)) {
                        $('<option/>').val(current).text(`${node.deviceName || current} (not found)`).appendTo(select);
                    }
                    select.val(current || (devices[0] && devices[0].deviceId)).trigger('change');
                    tip.text(devices.length ? '' : 'No devices of this family found on the headunit.');
                })
                .fail(function (xhr) {
                    tip.text((xhr.responseJSON && xhr.responseJSON.error) || 'Unable to load the devices.');
                    if (current && !select.find(`option[value="${current}"]`).length) {
                        $('<option/>').val(current).text(node.deviceName || current).appendTo(select);
                        select.val(current);
                    }
                });
        }

        /*--------------------------------------------------------------------------------------------------------------
            Da chiamare in oneditprepare
        --------------------------------------------------------------------------------------------------------------*/
        function prepareDevicePicker(node, familyId) {
            $('#node-input-deviceId').on('change', function () {
                const d = $(this).find(':selected').data('device');
                if (d) showItems(d.items);
            });
            $('#node-input-headunit').on('change', function () {
                loadDevices(node, familyId);
            });
            $('#node-input-lilitech-refresh').on('click', function () {
                loadDevices(node, familyId);
            });
        }

        /*--------------------------------------------------------------------------------------------------------------
            Da chiamare in oneditsave: salviamo nome e tipo per l'etichetta del nodo
        --------------------------------------------------------------------------------------------------------------*/
        function saveDevice(node) {
            const d = $('#node-input-deviceId').find(':selected').data('device');
            if (d) {
                node.deviceName = d.name;
                node.typeId = d.typeId;
            }
        }

        /*--------------------------------------------------------------------------------------------------------------
            Carica l'elenco degli scenari dalla headunit selezionata
        --------------------------------------------------------------------------------------------------------------*/
        function loadScenarios(node) {
            const select = $('#node-input-scenarioId');
            const headunitId = $('#node-input-headunit').val();
            const headunit = RED.nodes.node(headunitId);
            const current = select.val() || node.scenarioId;
            const tip = $('#node-input-lilitech-tip');

            if (!headunit) {
                tip.text('Select or create a headunit first.');
                return;
            }
            tip.text('Loading scenarios...');
            $.getJSON('lilitech/scenarios', { config: headunitId, url: headunit.url })
                .done(function (scenarios) {
                    select.empty();
                    scenarios
                        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                        .forEach(function (s) {
                            $('<option/>')
                                .val(s.scenarioId)
                                .text(`${s.name || s.scenarioId}${s.enable === false ? ' (disabled)' : ''}`)
                                .data('scenario', s)
                                .appendTo(select);
                        });
                    if (current && !scenarios.some((s) => s.scenarioId === current)) {
                        $('<option/>').val(current).text(`${node.scenarioName || current} (not found)`).appendTo(select);
                    }
                    select.val(current || (scenarios[0] && scenarios[0].scenarioId)).trigger('change');
                    tip.text(scenarios.length ? '' : 'No scenarios found on the headunit.');
                })
                .fail(function (xhr) {
                    tip.text((xhr.responseJSON && xhr.responseJSON.error) || 'Unable to load the scenarios.');
                    if (current && !select.find(`option[value="${current}"]`).length) {
                        $('<option/>').val(current).text(node.scenarioName || current).appendTo(select);
                        select.val(current);
                    }
                });
        }

        /*--------------------------------------------------------------------------------------------------------------
            Da chiamare in oneditprepare dei nodi scenario
        --------------------------------------------------------------------------------------------------------------*/
        function prepareScenarioPicker(node) {
            // Item accettato dal nodo: il play solo con il controllo manuale abilitato nell'app, come il tasto della card
            $('#node-input-scenarioId').on('change', function () {
                const s = $(this).find(':selected').data('scenario');
                if (!s) return showItems(null);
                const items = s.manualControl ? 'command (play, stop)' : 'command (stop only: play needs the manual control enabled in the app)';
                $('#node-input-lilitech-items').text(s.enable === false ? `${items} · scenario disabled` : items);
            });
            $('#node-input-headunit').on('change', function () {
                loadScenarios(node);
            });
            $('#node-input-lilitech-refresh').on('click', function () {
                loadScenarios(node);
            });
        }

        /*--------------------------------------------------------------------------------------------------------------
            Da chiamare in oneditsave dei nodi scenario: salviamo il nome per l'etichetta del nodo
        --------------------------------------------------------------------------------------------------------------*/
        function saveScenario(node) {
            const s = $('#node-input-scenarioId').find(':selected').data('scenario');
            if (s) node.scenarioName = s.name;
        }

        return { prepareDevicePicker, saveDevice, prepareScenarioPicker, saveScenario };
    })();
