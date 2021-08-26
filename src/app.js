const express = require('express');
const bodyParser = require('body-parser');
const sql = require('sequelize')
const { sequelize } = require('./model')
const { getProfile } = require('./middleware/getProfile')
const { bestProfession, bestClients } = require('./adminController')
//const { addBalanceToClient } = require('./middleware/balances')
const app = express();
app.set('sequelize', sequelize)
app.set('models', sequelize.models)
app.set('json spaces', 1)

const CLIENT = 'client'

/**
 *
 * @param {profile} profile
 * @returns true if the profile belongs to a client
 */
function isClient(profile) {
    return profile.type === CLIENT
}

/**
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models')
    var contract;
    if (isClient(req.profile)) {
        contract = await Contract.findOne({
            where: {
                id: req.params.id || 0,
                ClientId: req.profile.id
            }
        })
    } else {
        contract = await Contract.findOne({
            where: {
                id: req.params.id || 0,
                ContractorId: req.profile.id
            }
        })
    }
    if (!contract) {
        res.status(404).end("No contract found.")
    }
    res.json(contract)
})

/**
 * @returns all contracts for user
 */
app.get('/contracts/', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models')
    var contracts
    if (isClient(req.profile)) {
        contracts = await Contract.findAll({
            where: {
                ClientId: req.profile.id
            },
            whereNot: {
                status: 'terminated'
            }
        })
    } else {
        contracts = await Contract.findAll({
            where: {
                ContractorId: req.profile.id
            },
            whereNot: {
                status: 'terminated'
            }
        })
    }
    if (!contracts) {
        res.status(404).end("No contracts found")
    }
    res.json(contracts)
})

async function getUnpaidJobs(req, userId, isClient) {
    const { Job, Contract } = req.app.get('models')
    const contractWhere = {
        status: 'in_progress'
    }
    if (isClient) {
        contractWhere['ClientId'] = userId
    } else {
        contractWhere['ContractorId'] = userId
    }
    return await Job.findAll({
        include: {
            model: Contract,
            as: 'Contract',
            where: contractWhere
        },
        where: { paid: { [sql.Op.eq]: null } }
    })
}

/**
 * @returns all unpaid jobs for active contracts
 */
app.get('/jobs/unpaid/', getProfile, async (req, res) => {
    //  Get all unpaid jobs for a user (either a client or contractor), for active contracts only.

    const unpaidJobs = await getUnpaidJobs(req, req.profile.id, isClient(req.profile))
    if (!unpaidJobs) {
        res.status(404).end("No unpaid jobs found")
    }
    res.json(unpaidJobs)
})

/**
 * Pay a job
 */
app.post('/jobs/:job_id/pay', getProfile, async (req, res) => {

    /* Pay for a job
        a client can only pay if his balance >= the amount to pay
        The amount should be moved from the client's balance to the contractor balance.
    */

    // lets use transactions in case something breaks while updating tables
    const t = await sequelize.transaction()
    var message = "";

    try {
        const { Job, Profile, Contract } = req.app.get('models')

        if (!isClient(req.profile)) {
            throw "User is not client"
        }

        // First lets find the job and get all the info from there
        const job = await Job.findOne({
            include: {
                model: Contract,
                as: 'Contract',
                where: {
                    status: 'in_progress',
                    ClientId: req.profile.id
                }
            },
            where: {
                id: req.params.job_id,
                paid: {
                    [sql.Op.eq]: null
                }
            }
        })

        if (!job) {
            throw "No job found"
        }

        // Let's obtain both profiles
        const client = req.profile
        const contractor = await Profile.findOne({ where: { id: job.Contract.ContractorId } })

        // Make sure the client has enough money
        if (client.balance < job.price) {
            throw "Client does not have enough balance"
        }

        // Set job to paid
        await Job.update({
            paid: true, paymentDate: sql.literal('CURRENT_TIMESTAMP')
        }, {
            where: {
                id: req.params.job_id
            }
        }, { transaction: t })

        // Update client's balance
        await Profile.update({ balance: client.balance - job.price }, {
            where: {
                id: job.Contract.ClientId
            }
        }, { transaction: t })
        // Update contractor's balance
        await Profile.update({ balance: contractor.balance + job.price }, {
            where: {
                id: job.Contract.ContractorId
            }
        }, { transaction: t })

        await t.commit();
        message = "All done."
    } catch (error) {
        await t.rollback()
        res.status(500).end(error)
    }
    res.json(message)
})

/**
 * Deposit money for a client
 */
app.post('/balances/deposit/:userId', async (req, res) => {
    /* NOTE: We don't have any place where the deposit amount is being sent,
       so I will asume that we get the amount from a query string amount
    */
    const amount = Number(req.query.amount)
    if (isNaN(amount)) {
        res.status(500).end('Invalid amount')
    }
    const { Job, Contract, Profile } = req.app.get('models')

    const client = await Profile.findOne({ where: { id: req.params.userId } })

    // Let's make sure the ID corresponds to a client
    if (!client || client.type !== 'client') {
        res.status(500).end('Not a valid client ID')
    }

    // lets get all unpaid jobs (reusing code)
    const unpaidJobs = await getUnpaidJobs(res, req.params.userId, true)
    // get sum of prices for unpaid jobs
    const sumUnpaid = unpaidJobs.reduce((sum, val) => sum + val.price, 0)

    // deposit amount needs to be 25% or less
    if (amount * 4 > sumUnpaid) {
        res.status(500).end('Deposit is larger than 25% of unpaid jobs')
    }

    await Profile.update({ balance: client.balance + amount }, {
        where: {
            id: req.params.userId
        }
    })

    res.json('Deposit processed succesfully')
})

/**
 * Get best profession by date range
 */
app.get('/admin/best-profession', bestProfession, async (req, res) => {
    res.json(req.message)
})

/**
 * Get best clients by date range
 */
app.get('/admin/best-clients', bestClients, async (req, res) => {
    res.json(req.message)
})
module.exports = app;
