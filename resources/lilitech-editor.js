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

        return { prepareDevicePicker, saveDevice };
    })();
